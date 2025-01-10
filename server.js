const express = require('express');
const cors = require('cors');
const apiRoutes = require('./api');

const app = express();

// 配置 CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL]
    : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// 使用 API 路由
app.use('/api', apiRoutes);

// 只在开发环境启动服务器
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// 导出 app 实例供 Vercel 使用
module.exports = app; 