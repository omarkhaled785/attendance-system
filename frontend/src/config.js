// ملف تكوين API URL
// هذا الملف يحدد URL الصحيح للـ API بناءً على البيئة

const API_URL = import.meta.env.PROD 
  ? 'http://localhost:3001/api'  // في production (Electron)
  : 'http://localhost:3001/api'; // في development

export default API_URL;