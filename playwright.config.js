const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'test/browser',use:{baseURL:'http://127.0.0.1:3000',viewport:{width:390,height:844},launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},webServer:{command:'npm start',url:'http://127.0.0.1:3000',reuseExistingServer:false}});
