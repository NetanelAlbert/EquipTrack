import express from 'express';
import cors from 'cors';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send({ message: 'Backend works!' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
