<div align="center">
  <img src="assets/rblxswap_banner.png"/>
</div>

---

<p align="center">
  building from source
</p>

---

### ![terminal](https://www.readmecodegen.com/api/social-icon?name=terminal&size=16&color=%238b5cf6) environment setup

1. install [node.js](https://nodejs.org/) (v18 or higher recommended)
2. ensure you have `electron-builder` installed. if it's your first time:
```bash
npm install -g electron-builder
```
3. run `npm install` inside the directory to ensure all dependencies are installed

### ![play](https://www.readmecodegen.com/api/social-icon?name=play&size=16&color=%238b5cf6) compilation steps

because we added the `build` directive in `package.json`, you can simply run:
```bash
npx electron-builder --win
```
or you can run the `build.bat` script
```bash
.\build.bat
```
this produces a portable executable in the `dist` folder, as well as the unpacked version of it in `dist/win-unpacked`
