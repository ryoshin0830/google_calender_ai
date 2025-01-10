const { google } = require('googleapis');
require('dotenv').config();

// 从环境变量获取凭据
const credentials = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
};

// 创建 OAuth2 客户端
function getOAuth2Client() {
  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0]
  );
}

// 使用 refresh token 进行认证
async function authenticate() {
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return oAuth2Client;
}

module.exports = {
  authenticate
}; 