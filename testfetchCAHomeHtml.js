// import { fetchCAHomeHtml } from "./cricket-addictor/fetchCAHtml.js";

import { fetchCAHomeHtml } from "./cricket-addictor/fetchCAHtml.js";

const items = await fetchCAHomeHtml({ limit: 10 });
console.log(items);
