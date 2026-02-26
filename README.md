# CVMWebappV2

CVMWebappV2 is a rewritten version of the original webapp, that current CollabVM uses. Instead of using Bootstrap for the frontend, I wanted to go for something different. I removed all of the bootstrap elements and replaced them with TailwindCSS for a more modern look.

![Preview](./assets/preview.png)

## What this project uses
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

## Installation
With this frontend, nearly finished. It is now in a useable state and can be used for your own VMs. Updates will still be coming to this project until everything is finalized

```bash
git clone https://github.com/TotallyLumi/CVMWebappV2
cd CVMWebappV2
npm install
npm run build
```

If you want to run the webapp on port: 1234. Run this command:
```bash
npx parcel src/html/index.html
```