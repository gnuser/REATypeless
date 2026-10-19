import AppKit
let size=NSSize(width:1024,height:1024)
let image=NSImage(size:size)
image.lockFocus()
NSColor(calibratedRed:0.16,green:0.15,blue:0.18,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:40,y:40,width:944,height:944),xRadius:210,yRadius:210).fill()
let heights:[CGFloat]=[160,330,490,650,490,330,160]
for (i,h) in heights.enumerated(){NSColor(calibratedRed:0.53+CGFloat(i)*0.025,green:0.61+CGFloat(i)*0.02,blue:1,alpha:1).setFill();NSBezierPath(roundedRect:NSRect(x:CGFloat(210+i*90),y:(1024-h)/2,width:52,height:h),xRadius:26,yRadius:26).fill()}
image.unlockFocus()
let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!
try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
