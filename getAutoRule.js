import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false
};

const unmarshallOptions = {
  wrapNumbers: false
};

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions,
  unmarshallOptions
});

const header = {
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT',
  'Content-Type': 'application/json'
}

export const handler = async (event) => {
  const u_id = event.requestContext.authorizer.claims.sub;

  const d_state_params = {
    TableName: 'IoTPlat_AutoRules',
    KeyConditionExpression: 'user_id = :uid',
    ExpressionAttributeValues: {
      ':uid': u_id
    }
  };

  let ruleFindResult = null;
  try {
    ruleFindResult = await client.send(new QueryCommand(d_state_params));
  } catch (e) {
    console.log(`No Data: ${e}`);
  }

  if (ruleFindResult === null) {
    return {
      statusCode: 404,
      headers: header,
      body: JSON.stringify({
        description: "Cannot find data!"
      })
    }
  }

  return {
    statusCode: 200,
    headers: header,
    body: JSON.stringify({
      'size': ruleFindResult.Items.length,
      "rules": ruleFindResult.Items
    })
  }

}