const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const credentials = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
};

const oAuth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

// 生成授权URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('请访问此URL进行授权：');
console.log(authUrl);
console.log('\n获取授权码后，请在此输入：');

// 读取用户输入的授权码
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    console.log('\n获取到的 refresh token:');
    console.log(tokens.refresh_token);
    process.exit(0);
  } catch (error) {
    console.error('获取 token 失败:', error.message);
    process.exit(1);
  }
}); 