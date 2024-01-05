const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');
const serverless = require('serverless-http');

const port = 3000;
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
      <h1>This is Golden Jewellery!!</h1> <br>
    </body>
  </html>
  `;
const htmlFile = `
<html>
  <head>
    <meta name="ondc-site-verification" content="SIGNED_UNIQUE_REQ_ID" />
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

const app = express();
app.use(bodyParser.json());

const router = express.Router(); // Create a router instance

router.post('/on_subscribe', function (req, res) {
  const { challenge } = req.body;
  const answer = decryptAES256ECB(sharedKey, challenge);
  const resp = { answer: answer };
  res.status(200).json(resp);
});

router.get('/ondc-site-verification.html', async (req, res) => {
  const signedContent = await signMessage(REQUEST_ID, SIGNING_PRIVATE_KEY);
  const modifiedHTML = htmlFile.replace(/SIGNED_UNIQUE_REQ_ID/g, signedContent);
  res.send(modifiedHTML);
});

router.get('/', async (req, res) => {
  res.send(indexHtml + ' Hello World!');
});

app.use('/.ondc-server/functions/api', router); // Use the router in your app

app.get('/health', (req, res) => res.send('Health OK!!'));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

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

module.exports.handler = serverless(app); // Export the serverless handler
