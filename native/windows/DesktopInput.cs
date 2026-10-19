using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
public static class DesktopInput {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window,int command);
 public static uint WindowProcess(IntPtr window) { uint process; GetWindowThreadProcessId(window,out process); return process; }
 public static Task<string> ReadNext() { return Task.Factory.StartNew(() => Console.ReadLine()); }
 public static void Activate(IntPtr window) {
  if (GetForegroundWindow()==window) return;
  if (IsIconic(window)) ShowWindowAsync(window,9);
  SetForegroundWindow(window);
 }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern int LCMapStringEx(string locale,uint flags,string source,int length,StringBuilder dest,int capacity,IntPtr version,IntPtr reserved,IntPtr sort);
}
