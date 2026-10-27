# docs/demo/demo.tape
# VHS script for recording an automated demo GIF of StackDoctor
# To execute: vhs docs/demo/demo.tape

Output docs/demo/stackdoctor-demo.gif

Set FontSize 16
Set Width 1200
Set Height 720
Set Padding 20
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful

Type "cd examples/broken-node-project"
Enter
Sleep 1s

Type "npm start"
Enter
Sleep 2s

Type "npx stackdoctor scan"
Enter
Sleep 4s

Type "npx stackdoctor explain NODE_DEPS_NOT_INSTALLED"
Enter
Sleep 3s

Type "npm install"
Enter
Sleep 3s

Type "npx stackdoctor scan"
Enter
Sleep 3s
