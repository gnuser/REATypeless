var memory=FocusMemory<String>()
memory.observe(pid:10,candidate:"text-field@cursor5")
memory.observe(pid:10,candidate:nil) // macOS deactivation transient
precondition(memory.value=="text-field@cursor5", "Losing focus must not erase the original input")
memory.observe(pid:11,candidate:nil)
precondition(memory.value==nil, "A different app must not inherit a stale input")
memory.observe(pid:11,candidate:"second-field")
precondition(memory.value=="second-field")
print("FocusMemory regression passed")

precondition(replacementResult("LEFT  RIGHT",location:5,length:0,text:"voice")=="LEFT voice RIGHT")
precondition(replacementResult("A😀B",location:1,length:2,text:"voice")=="AvoiceB")
precondition(replacementResult("abc",location:4,length:0,text:"x")==nil)
print("Selection replacement regression passed")

precondition(simplifiedText("現在開始錄音，軟體測試。 Hello world!")=="现在开始录音，软体测试。 Hello world!")
precondition(simplifiedText("測試 `變數` 和 ```繁體代碼``` https://example.com/繁體")=="测试 `變數` 和 ```繁體代碼``` https://example.com/繁體")
print("Simplified Chinese output passed")
