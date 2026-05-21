import { app } from "./app";

const port = Number(process.env.PORT ?? 8787);

app.listen(port, "127.0.0.1", () => {
  console.log(`Nezbig API listening on http://127.0.0.1:${port}`);
});
