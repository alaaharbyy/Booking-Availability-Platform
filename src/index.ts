import "dotenv/config";
import { app } from "./app.js";

const port = Number(process.env.PORT) ;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
