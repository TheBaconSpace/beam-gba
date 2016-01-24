/ Modified version of sega collection setup
## Setup
1. Get yourself [Nodejs](http://Nodejs.org) and Java
2. Download this project as a zip file
3. Unzip it.
4. Open a terminal/cmd in its folder
5. Enter npm install. This will install project dependancies
6. Write a config file in config/ called default.json follow the sample one for a guide.
7. Open Your GBA emulator

I've set this up to use the top row of the keyboard 1 - =. This keeps things like WSAD free for YOU to use if you don't have a controller. I'm also limited by the choice of keys that the underlying nodejs module that pushes keyboard keys for you can use.

The end goal is to emulate a HID device and ouput button pushes so we don't have to use your keyboard but until then. Pause interactive mode if you need to type.

Controller keys as follows
    Up = 1
    Down = 2
    Left = 3
    Right = 4
    A = 5
    B = 6
    Start = 7
    Select = 8
