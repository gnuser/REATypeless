// Retain the last editable field while its application temporarily loses AX focus.
struct FocusMemory<Value> {
 private(set) var pid:Int32?
 private(set) var value:Value?
 mutating func observe(pid:Int32,candidate:Value?){
  if self.pid != pid { value=nil }
  self.pid=pid
  if let candidate=candidate { value=candidate }
 }
}

import Foundation

func replacementResult(_ original:String,location:Int,length:Int,text:String)->String? {
 let value=original as NSString
 guard location>=0,length>=0,location<=value.length,length<=value.length-location else{return nil}
 return value.replacingCharacters(in:NSRange(location:location,length:length),with:text)
}

import CoreFoundation
// Preserve code spans and URLs; convert only prose using macOS's ICU transform.
func simplifiedText(_ original:String)->String {
 let pattern="```[\\s\\S]*?```|`[^`\\n]*`|https?://[^\\s]+"
 let regex=try! NSRegularExpression(pattern:pattern)
 let full=original as NSString
 let matches=regex.matches(in:original,range:NSRange(location:0,length:full.length))
 var cursor=0,result=""
 func convert(_ text:String)->String {
  let mutable=NSMutableString(string:text)
  CFStringTransform(unsafeBitCast(mutable,to:CFMutableString.self),nil,"Traditional-Simplified" as CFString,false)
  return mutable as String
 }
 for match in matches {result+=convert(full.substring(with:NSRange(location:cursor,length:match.range.location-cursor)));result+=full.substring(with:match.range);cursor=NSMaxRange(match.range)}
 result+=convert(full.substring(from:cursor));return result
}
