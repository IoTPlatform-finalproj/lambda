import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();

const header = {
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,DELETE',
  'Content-Type': 'application/json'
}

export const handler = async (event) => {
  const r_id = event?.pathParameters?.rule_id ?? ""
  const u_id = event.requestContext.authorizer.claims.sub

  if (r_id === "") {
    return {
      statusCode: 400,
      headers: header,
      body: {
        "message": "No rule id provided!"
      }
    };
  }

  const command = new DeleteItemCommand({
    "Key": {
      "user_id": {
        "S": u_id
      },
      "rule_id": {
        "S": r_id
      }
    },
    "TableName": "IoTPlat_AutoRules"
  })

  const response = await client.send(command)

  return {
    statusCode: 200,
    headers: header,
    body: JSON.stringify(response)
  }
}