const fs = require('fs');
const path = require('path');

const shortcutContent = `[InternetShortcut]
URL=file:///%CD%/start-app.bat
IconIndex=0
IconFile=%CD%\\icon.ico
HotKey=0
IDList=
`;

const shortcutPath = path.join(process.env.USERPROFILE, 'Desktop', 'نظام الحضور والانصراف.url');
fs.writeFileSync(shortcutPath, shortcutContent, 'utf8');
console.log('✅ تم إنشاء اختصار على سطح المكتب');