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
  const sensor_id = event.pathParameters.sensor_id
  const queryParams = event?.queryStringParameters ?? {}

  const startTimestamp = parseInt(queryParams.start_time ?? 0)
  const endTimestamp = parseInt(queryParams.end_time ?? Date.now())
  const logLimit = queryParams.limit ?? 100

  const d_state_params = {
    TableName: 'IoTPlat_SensorStatus',
    KeyConditionExpression: 'sensor_id = :sensorId AND #timestampAttr BETWEEN :startTimestamp AND :endTimestamp',
    ExpressionAttributeNames: {
      '#timestampAttr': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':sensorId': sensor_id,
      ':startTimestamp': startTimestamp,
      ':endTimestamp': endTimestamp
    },
    ScanIndexForward: false, // 역순
    Limit: logLimit
  };

  let sensorStatusResult = null;
  try {
    sensorStatusResult = await client.send(new QueryCommand(d_state_params));
  } catch (e) {
    console.log(`No Data: ${e}`);
  }

  if (sensorStatusResult === null) {
    return {
      statusCode: 404,
      headers: header,
      body: JSON.stringify({
        description: "Cannot find data!"
      })
    }
  }
  
  const sensorStatusList = sensorStatusResult.Items.map((item) => {
    const mappedItem = {}
    mappedItem.timestamp = item.timestamp
      if (item?.value !== undefined && item.value !== null) mappedItem.value = parseInt(item.value)
      if (item?.is_on !== undefined && item.is_on !== null) mappedItem.is_on = item.is_on
    return mappedItem
  })

  return {
    statusCode: 200,
    headers: header,
    body: JSON.stringify({
      'size': sensorStatusList.length,
      "sensor_log": sensorStatusList
    })
  }

}