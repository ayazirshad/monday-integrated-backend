import express from "express";
import { Logger } from "@mondaycom/apps-sdk";
import { transformText } from "./src/transformation-service.js";
import { authorizeRequest } from "./src/middleware.js";
import {
  changeColumnValue,
  createMondayItem,
  getColumnValue,
  getItemName,
} from "./src/monday-api-service.js";
import { getSecret, isDevelopmentEnv, getEnv } from "./src/helpers.js";
import dotenv from "dotenv";
import { readQueueMessage, produceMessage } from "./src/queue-service.js";
dotenv.config();

const logTag = "ExpressServer";
const PORT = "PORT";
const SERVICE_TAG_URL = "SERVICE_TAG_URL";
const TO_UPPER_CASE = "TO_UPPER_CASE";
const TO_LOWER_CASE = "TO_LOWER_CASE";

const logger = new Logger(logTag);
const currentPort = getSecret(PORT); // Port must be 8080 to work with monday code
const currentUrl = getSecret(SERVICE_TAG_URL);

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send({ message: "hello from backend" });
});

app.post("/monday/execute_action", authorizeRequest, async (req, res) => {
  // logger.info(
  //   JSON.stringify(
  //     {
  //     message: "New request received",
  //     path: "/action",
  //     body: req.body,
  //     headers: req.headers,
  //   }
  // )
  // );
  console.log("message", "New request received");
  console.log("path", "/action");
  console.log("body", req.body);
  console.log("headers", req.headers);
  const { shortLivedToken } = req.session;
  const { payload } = req.body;

  try {
    const { inputFields } = payload;
    const {
      boardId,
      itemId,
      sourceColumnId,
      targetColumnId,
      transformationType,
    } = inputFields;

    const value = await getColumnValue(shortLivedToken, itemId, sourceColumnId);
    const name = await getItemName(shortLivedToken, itemId);
    console.log("value", value);
    console.log("name", name);
    if (!value) {
      return res.status(200).send({});
    }
    const transformedText = transformText(
      value,
      transformationType ? transformationType.value : "TO_UPPER_CASE"
    );

    await changeColumnValue(
      shortLivedToken,
      boardId,
      itemId,
      targetColumnId,
      transformedText
    );

    return res.status(200).send({});
  } catch (err) {
    logger.error(err);
    return res.status(500).send({ message: "internal server error" });
  }
});

app.post(
  "/monday/get_remote_list_options",
  authorizeRequest,
  async (req, res) => {
    const TRANSFORMATION_TYPES = [
      { title: "to upper case", value: TO_UPPER_CASE },
      { title: "to lower case", value: TO_LOWER_CASE },
    ];
    try {
      return res.status(200).send(TRANSFORMATION_TYPES);
    } catch (err) {
      logger.error(err);
      return res.status(500).send({ message: "internal server error" });
    }
  }
);

app.post("/create-loan", async (req, res) => {
  try {
    // Updated to accept 'groupId' from the request body
    const { boardId, itemName, loanAmount, loanColumnId, groupId } = req.body;
    console.log("req.body", req.body);
    // Prepare the columnValues object from the received data
    const columnValues = {};
    if (loanAmount && loanColumnId) {
      columnValues[loanColumnId] = loanAmount;
    }

    // Pass the new 'groupId' to the service function
    const response = await createMondayItem(
      boardId,
      itemName,
      columnValues,
      groupId
    );

    // Respond with the monday.com API response
    res.status(200).json(response);
  } catch (err) {
    console.error("Error creating monday item:", err.message);
    res
      .status(500)
      .json({ error: "Failed to create monday item", details: err.message });
  }
});

app.post("/produce", async (req, res) => {
  try {
    const { body } = req;
    const message = JSON.stringify(body);
    const messageId = await produceMessage(message);
    return res.status(200).send({ messageId });
  } catch (err) {
    logger.error(JSON.stringify(err));
    return res.status(500).send({ message: "internal server error" });
  }
});

app.post("/mndy-queue", async (req, res) => {
  try {
    const { body, query } = req;
    readQueueMessage({ body, query });
    return res.status(200).send({}); // return 200 to ACK the queue message
  } catch (err) {
    logger.error(err.error);
    return res.status(500).send({ message: "internal server error" });
  }
});

app.listen(currentPort, () => {
  if (isDevelopmentEnv()) {
    logger.info(`app running locally on port ${currentPort}`);
  } else {
    logger.info(
      `up and running listening on port:${currentPort}`,
      "server_runner",
      {
        env: getEnv(),
        port: currentPort,
        url: `https://${currentUrl}`,
      }
    );
  }
});
