import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

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

/* Add and modify auto rule */
export const handler = async (event) => {
  const req_body = JSON.parse(event.body);
  
  const u_id = event.requestContext.authorizer.claims.sub;
  
  let rule_id = event?.pathParameters?.rule_id ?? "";
  const isRuleUpdate = (rule_id !== "");
  if (!isRuleUpdate) {
    rule_id = "atr_" + generateUUID();
  }
  
  const device_id = req_body['device_id'];
  const sensor_id = req_body['sensor_id'];
  const rule_type = req_body['rule_type'];
  const target_value = req_body['target_value'];
  const change_to = req_body['change_to'];
  
  try {
    const new_rule = {
      'user_id': u_id,
      'rule_id': rule_id,
      'device_id': device_id,
      'sensor_id': sensor_id,
      'rule_type': rule_type,
      'target_value': target_value,
      'change_to': change_to
    };

    const putRules = new PutCommand({
      TableName: "IoTPlat_AutoRules",
      Item: new_rule
    });
    const putResponse = await docClient.send(putRules);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET'
      },
      body: JSON.stringify({
        description: "OK"
      })
    };
  }
  catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET'
      },
      body: JSON.stringify({ message: 'Internal Server Error(addAutoRules)', error: e })
    };
  }
}


function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}