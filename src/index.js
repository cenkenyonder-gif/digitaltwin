const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/chat', (req, res) => {
  res.json({ reply: 'You said: ' + (req.body.message || '') });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Listening on ' + PORT));
