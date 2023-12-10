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
  'Access-Control-Allow-Methods': 'OPTIONS,GET',
  'Content-Type': 'application/json'
}

export const handler = async (event) => {
  const device_id = event.pathParameters.device_id
  const queryParams = event?.queryStringParameters ?? {}

  const startTimestamp = parseInt(queryParams.start_time ?? 0)
  const endTimestamp = parseInt(queryParams.end_time ?? Date.now())
  const logLimit = queryParams.limit ?? 100

  const d_state_params = {
    TableName: 'IoTPlat_DeviceStatus',
    KeyConditionExpression: 'device_id = :deviceId AND #timestampAttr BETWEEN :startTimestamp AND :endTimestamp',
    ExpressionAttributeNames: {
      '#timestampAttr': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':deviceId': device_id,
      ':startTimestamp': startTimestamp,
      ':endTimestamp': endTimestamp
    },
    ScanIndexForward: false, // 역순
    Limit: logLimit
  };

  let deviceStatusResult = null;
  try {
    deviceStatusResult = await client.send(new QueryCommand(d_state_params));
  } catch (e) {
    console.log(`No Data: ${e}`);
  }

  if (deviceStatusResult === null) {
    return {
      statusCode: 404,
      headers: header,
      body: JSON.stringify({
        description: "Cannot find data!"
      })
    }
  }
  
  const deviceStatusList = deviceStatusResult.Items.map((item) => {
    const mappedItem = {}
    mappedItem.is_active = item.is_active
    mappedItem.timestamp = item.timestamp
    if (item?.step !== undefined && item.step !== null) mappedItem.step = parseInt(item.step)
    return mappedItem
  })

  return {
    statusCode: 200,
    headers: header,
    body: JSON.stringify({
      'size': deviceStatusList.length,
      "device_log": deviceStatusList
    })
  }

}