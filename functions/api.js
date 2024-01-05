const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

const app = express();

const ENCRYPTION_PRIVATE_KEY =
  'MC4CAQAwBQYDK2VuBCIEIPAC60XJgwHtjoXvRN6Lt4QuMosSJzh2wt9KQB6+8LVE';
const ONDC_PUBLIC_KEY =
  'MCowBQYDK2VuAyEAlKHWJWiEiHFGlAJ6TE4VMGaeQUYg5DHEpuQdiq6flnQ=';
const REQUEST_ID = 'e32c5bbf-af81-4a4e-96f9-cb4a3bbe7ab0';
const SIGNING_PRIVATE_KEY =
  'khRaBnltQraVLivcqw/JZWzyIupcWeQFUUCFsuijj8io7dAUUUxgN5DOKpuq4TEWdyXXlm1iCDSRICzp6nzogg==';

const indexHtml = `
<html>
  <head>
  </head>
  <body>
    <h1>This is Golden Jewellery !!</h1> <br>
  </body>
</html>
`;

const htmlFile = `
<html>
  <head>
    <meta
      name="ondc-site-verification"
      content="SIGNED_UNIQUE_REQ_ID"
    />
  </head>
  <body>
    <h1>ONDC Site Verification Page</h1>
  </body>
</html>
`;

const privateKey = crypto.createPrivateKey({
  key: Buffer.from(ENCRYPTION_PRIVATE_KEY, 'base64'),
  format: 'der',
  type: 'pkcs8',
});

const publicKey = crypto.createPublicKey({
  key: Buffer.from(ONDC_PUBLIC_KEY, 'base64'),
  format: 'der',
  type: 'spki',
});

const sharedKey = crypto.diffieHellman({
  privateKey: privateKey,
  publicKey: publicKey,
});

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send(indexHtml + ' Hello World!');
});

app.post('/add', (req, res) => {
  res.send('New record added.');
});

app.delete('/', (req, res) => {
  res.send('Deleted existing record');
});

app.put('/', (req, res) => {
  res.send('Updating existing record');
});

app.get('/demo', (req, res) => {
  res.json([
    {
      id: '001',
      name: 'Smith',
      email: 'smith@gmail.com',
    },
    {
      id: '002',
      name: 'Sam',
      email: 'sam@gmail.com',
    },
    {
      id: '003',
      name: 'lily',
      email: 'lily@gmail.com',
    },
  ]);
});

app.post('/on_subscribe', function (req, res) {
  const { challenge } = req.body;
  const answer = decryptAES256ECB(sharedKey, challenge);
  const resp = { answer: answer };
  res.status(200).json(resp);
});

app.get('/ondc-site-verification.html', async (req, res) => {
  const signedContent = await signMessage(REQUEST_ID, SIGNING_PRIVATE_KEY);
  const modifiedHTML = htmlFile.replace(/SIGNED_UNIQUE_REQ_ID/g, signedContent);
  res.send(modifiedHTML);
});

app.get('/health', (req, res) => res.send('Health OK!!'));

module.exports.handler = serverless(app);

function decryptAES256ECB(key, encrypted) {
  const iv = Buffer.alloc(0);
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function signMessage(signingString, privateKey) {
  await _sodium.ready;
  const sodium = _sodium;
  const signedMessage = sodium.crypto_sign_detached(
    signingString,
    sodium.from_base64(privateKey, _sodium.base64_variants.ORIGINAL)
  );
  const signature = sodium.to_base64(
    signedMessage,
    _sodium.base64_variants.ORIGINAL
  );
  return signature;
}
