import AppKit
import ApplicationServices
import CryptoKit

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
 var value: CFTypeRef?
 return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}
func axElement(_ value: CFTypeRef?) -> AXUIElement? {
 guard let value=value, CFGetTypeID(value)==AXUIElementGetTypeID() else { return nil }
 return unsafeBitCast(value, to: AXUIElement.self)
}
func selectedRange(_ element: AXUIElement) -> CFRange? {
 guard let value=attribute(element,kAXSelectedTextRangeAttribute),CFGetTypeID(value)==AXValueGetTypeID() else{return nil}
 var range=CFRange();guard AXValueGetValue(unsafeBitCast(value,to:AXValue.self),.cfRange,&range) else{return nil};return range
}
func digest(_ element: AXUIElement) -> String? {
 guard let value=attribute(element,kAXValueAttribute) as? String else{return nil}
 return SHA256.hash(data:Data(value.utf8)).map{String(format:"%02x",$0)}.joined()
}
struct Destination {
 let pid:pid_t
 let element:AXUIElement
 let window:AXUIElement
 let range:CFRange
 let fingerprint:String?
}
final class Tracker {
 let owner:pid_t
 var memory=FocusMemory<Destination>()
 var deliveryDiagnostic:[String:Any]=[:]
 var inspectionReason="No focused input"
 var sessions:[String:Destination]=[:]
 init(owner:pid_t){self.owner=owner}
 func inspect(_ pid:pid_t) -> Destination? {
  guard AXIsProcessTrusted(),pid != owner,let app=NSRunningApplication(processIdentifier:pid),app.bundleIdentifier != "local.reatypeless.desktop",!app.isTerminated else{return nil}
  let appElement=AXUIElementCreateApplication(pid)
  guard let focused=axElement(attribute(appElement,kAXFocusedUIElementAttribute)) else{inspectionReason="No focused element in \(app.localizedName ?? "app")";return nil}
  guard let window=axElement(attribute(focused,kAXWindowAttribute)) ?? axElement(attribute(appElement,kAXFocusedWindowAttribute)) else{inspectionReason="No focused window";return nil}
  guard let range=selectedRange(focused) else{inspectionReason="Input does not expose a cursor (\(attribute(focused,kAXRoleAttribute) as? String ?? "unknown"))";return nil}
  let subrole=attribute(focused,kAXSubroleAttribute) as? String ?? ""
  guard subrole != kAXSecureTextFieldSubrole as String else{return nil}
  return Destination(pid:pid,element:focused,window:window,range:range,fingerprint:digest(focused))
 }
 func refresh(){
  guard let front=NSWorkspace.shared.frontmostApplication,front.processIdentifier != owner,front.bundleIdentifier != "local.reatypeless.desktop",front.processIdentifier != ProcessInfo.processInfo.processIdentifier else{return}
  memory.observe(pid:front.processIdentifier,candidate:inspect(front.processIdentifier))
 }
 func capture(_ ask:Bool)->[String:Any]{
  guard AXIsProcessTrusted() else{return ["status":"permission"]}
  refresh()
  // AX focus normally survives app deactivation; refresh the caret on button entry.
  if let pid=memory.pid {memory.observe(pid:pid,candidate:inspect(pid))}
  guard let destination=memory.value else{return ["status":"no-target","reason":inspectionReason]}
  let token=UUID().uuidString; sessions[token]=destination
  if sessions.count>8 {sessions=sessions.filter{$0.key==token}}
  return ["status":"ok","token":token,"selection":ask ? (attribute(destination.element,kAXSelectedTextAttribute) as? String ?? "") : ""]
 }
 func restore(_ token:String)->String{
  guard AXIsProcessTrusted() else{return "permission"}
  guard let target=sessions[token],let app=NSRunningApplication(processIdentifier:target.pid),!app.isTerminated else{return "closed"}
  guard attribute(target.element,kAXRoleAttribute) != nil,attribute(target.window,kAXRoleAttribute) != nil else{return "closed"}
  if let old=target.fingerprint, digest(target.element) != old{return "edited"}
  AXUIElementSetAttributeValue(target.window,kAXMinimizedAttribute as CFString,kCFBooleanFalse)
  app.activate(options:[.activateIgnoringOtherApps])
  AXUIElementPerformAction(target.window,kAXRaiseAction as CFString)
  AXUIElementSetAttributeValue(target.element,kAXFocusedAttribute as CFString,kCFBooleanTrue)
  var range=target.range
  guard let value=AXValueCreate(.cfRange,&range),AXUIElementSetAttributeValue(target.element,kAXSelectedTextRangeAttribute as CFString,value) == .success else{return "unsupported"}
  return "ok"
 }
 func paste(_ token:String)->String{
  deliveryDiagnostic=[:]
  guard let destination=sessions[token] else{return "closed"}
  deliveryDiagnostic["targetPID"]=destination.pid
  deliveryDiagnostic["cursor"]=destination.range.location
  defer{sessions.removeValue(forKey:token)}
  let restored=restore(token);guard restored=="ok" else{return restored}
  for _ in 0..<40 {
   if NSWorkspace.shared.frontmostApplication?.processIdentifier==destination.pid && CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand,.maskControl,.maskAlternate,.maskShift]).isEmpty{break}
   RunLoop.current.run(until:Date(timeIntervalSinceNow:0.025))
  }
  guard NSWorkspace.shared.frontmostApplication?.processIdentifier==destination.pid,
   let focused=axElement(attribute(AXUIElementCreateApplication(destination.pid),kAXFocusedUIElementAttribute)),CFEqual(focused,destination.element),
   let range=selectedRange(focused),range.location==destination.range.location,range.length==destination.range.length,
   CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand,.maskControl,.maskAlternate,.maskShift]).isEmpty else{return "changed"}
  guard let text=NSPasteboard.general.string(forType:.string),!text.isEmpty else{return "failed"}
  let before=attribute(destination.element,kAXValueAttribute) as? String
  let expected=before.flatMap{replacementResult($0,location:destination.range.location,length:destination.range.length,text:text)}
  func delivered()->Bool {
   if let expected=expected {return attribute(destination.element,kAXValueAttribute) as? String == expected}
   guard let range=selectedRange(destination.element) else{return false}
   return range.location==destination.range.location+(text as NSString).length && range.length==0
  }
  // Native editors support replacing only the saved selection without synthetic keys.
  deliveryDiagnostic["beforeLength"]=before.map{($0 as NSString).length}
  let direct=AXUIElementSetAttributeValue(destination.element,kAXSelectedTextAttribute as CFString,text as CFString)
  deliveryDiagnostic["directResult"]=direct.rawValue
  if direct == .success {
   for _ in 0..<20 {if delivered(){return "ok"};RunLoop.current.run(until:Date(timeIntervalSinceNow:0.025))}
  }
  // Retry only when both text and selection prove the previous operation did nothing.
  guard let before=before,attribute(destination.element,kAXValueAttribute) as? String == before,
   let unchangedRange=selectedRange(destination.element),unchangedRange.location==destination.range.location,
   unchangedRange.length==destination.range.length else{return "unverified"}
  func pasteItem(_ element:AXUIElement,depth:Int=0)->AXUIElement? {
   guard depth<5 else{return nil}
   let key=attribute(element,"AXMenuItemCmdChar") as? String
   let modifiers=(attribute(element,"AXMenuItemCmdModifiers") as? NSNumber)?.intValue
   if key?.lowercased()=="v",modifiers==0,attribute(element,kAXEnabledAttribute) as? Bool == true{return element}
   for child in attribute(element,kAXChildrenAttribute) as? [AXUIElement] ?? [] {
    if let found=pasteItem(child,depth:depth+1){return found}
   }
   return nil
  }
  deliveryDiagnostic["stage"]="menu"
  if let menu=axElement(attribute(AXUIElementCreateApplication(destination.pid),kAXMenuBarAttribute)),
   let item=pasteItem(menu),AXUIElementPerformAction(item,kAXPressAction as CFString) == .success {
   for _ in 0..<40 {if delivered(){return "ok"};RunLoop.current.run(until:Date(timeIntervalSinceNow:0.025))}
   return "unverified"
  }
  deliveryDiagnostic["stage"]="keyboard"
  let source=CGEventSource(stateID:.combinedSessionState)
  guard let down=CGEvent(keyboardEventSource:source,virtualKey:9,keyDown:true),let up=CGEvent(keyboardEventSource:source,virtualKey:9,keyDown:false) else{return "failed"}
  down.flags = .maskCommand;up.flags = .maskCommand;down.post(tap:.cgSessionEventTap);Thread.sleep(forTimeInterval:0.05);up.post(tap:.cgSessionEventTap)
  for _ in 0..<40 {if delivered(){return "ok"};RunLoop.current.run(until:Date(timeIntervalSinceNow:0.025))}
  return "unverified"
 }
}
let args=CommandLine.arguments
switch args.dropFirst().first ?? "" {
case "status":print(AXIsProcessTrusted() ? "ok":"permission")
case "permission":
 print(AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary) ? "ok":"permission")
case "serve":
 let tracker=Tracker(owner:args.count>2 ? pid_t(args[2]) ?? 0:0)
 let center=NSWorkspace.shared.notificationCenter
 center.addObserver(forName:NSWorkspace.didDeactivateApplicationNotification,object:nil,queue:.main){note in
  if let app=note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,app.processIdentifier != tracker.owner,app.bundleIdentifier != "local.reatypeless.desktop" {
   tracker.memory.observe(pid:app.processIdentifier,candidate:tracker.inspect(app.processIdentifier))
  }
 }
 center.addObserver(forName:NSWorkspace.didActivateApplicationNotification,object:nil,queue:.main){_ in tracker.refresh()}
 let timer=Timer.scheduledTimer(withTimeInterval:0.15,repeats:true){_ in tracker.refresh()};RunLoop.main.add(timer,forMode:.common)
 tracker.refresh()
 DispatchQueue.global().async {
  while let line=readLine(){
   guard let bytes=line.data(using:.utf8),let request=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any],let id=request["id"] as? Int else{continue}
   DispatchQueue.main.async {
    var result:[String:Any]=[:]
    let token=request["token"] as? String ?? ""
    switch request["op"] as? String ?? "" {
    case "simplify":result=["text":simplifiedText(request["text"] as? String ?? "")]
    case "status":result=["status":AXIsProcessTrusted() ? "ok":"permission"]
    case "capture":result=tracker.capture(request["ask"] as? Bool ?? false)
    case "paste":let status=tracker.paste(token);result=["status":status,"diagnostic":tracker.deliveryDiagnostic]
    case "release":tracker.sessions.removeValue(forKey:token);result=["status":"ok"]
    default:result=["status":"unknown"]
    }
    result["id"]=id
    if let data=try? JSONSerialization.data(withJSONObject:result),let text=String(data:data,encoding:.utf8){print(text);fflush(stdout)}
   }
  }
  DispatchQueue.main.async{exit(0)}
 }
 RunLoop.main.run()
default:exit(1)
}
