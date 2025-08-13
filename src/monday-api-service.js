import initMondayClient from "monday-sdk-js";
import { Logger } from "@mondaycom/apps-sdk";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const mondayAPIUrl = "https://api.monday.com/v2";

// Function to perform a GraphQL query against monday.com
const mondayGraphQL = async (token, query, variables) => {
  try {
    const response = await axios.post(
      mondayAPIUrl,
      {
        query,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error(
      "Error in mondayGraphQL:",
      err.response ? err.response.data : err.message
    );
    throw new Error("Failed to execute GraphQL query against monday.com");
  }
};

const logTag = "Middleware";
const logger = new Logger(logTag);

export const getColumnValue = async (token, itemId, columnId) => {
  try {
    const mondayClient = initMondayClient();
    mondayClient.setApiVersion("2024-01");
    mondayClient.setToken(token);

    const query = `query($itemId: [ID!], $columnId: [String!]) {
          items (ids: $itemId) {
            column_values(ids:$columnId) {
              value
            }
          }
        }`;
    const variables = { columnId, itemId };

    const response = await mondayClient.api(query, { variables });
    return response.data.items[0].column_values[0].value;
  } catch (err) {
    logger.error(err);
  }
};

export const getItemName = async (token, itemId) => {
  try {
    const mondayClient = initMondayClient();
    mondayClient.setApiVersion("2024-01");
    mondayClient.setToken(token);

    // This query specifically requests the top-level 'name' field
    const query = `query($itemId: [ID!]) {
        items (ids: $itemId) {
          name
        }
      }`;
    const variables = { itemId };

    const response = await mondayClient.api(query, { variables });

    // The response data is structured differently for the name field
    return response.data.items[0].name;
  } catch (err) {
    logger.error(err);
    throw err;
  }
};

export const changeColumnValue = async (
  token,
  boardId,
  itemId,
  columnId,
  value
) => {
  try {
    const mondayClient = initMondayClient({ token });
    mondayClient.setApiVersion("2024-01");

    const query = `mutation change_column_value($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
            id
          }
        }
        `;
    const variables = { boardId, columnId, itemId, value };

    const response = await mondayClient.api(query, { variables });
    return response;
  } catch (err) {
    logger.error(err);
  }
};

export const createMondayItem = async (
  boardId,
  itemName,
  columnValues,
  groupId
) => {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new Error("MONDAY_API_TOKEN environment variable is not set.");
  }
  console.log("going to run query");
  const query = `
        mutation createItem($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String!) {
            create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, group_id: $groupId) {
                id
            }
        }
    `;
  const variables = {
    boardId,
    itemName,
    columnValues: JSON.stringify(columnValues),
    groupId,
  };

  return mondayGraphQL(token, query, variables);
};
