// import { IoTDataClient, UpdateThingShadowCommand } from "@aws-sdk/client-iot";
import { IoTDataPlaneClient, UpdateThingShadowCommand } from "@aws-sdk/client-iot-data-plane"; // ES Modules import


const iot = new IoTDataPlaneClient({ region: 'us-east-1' });

const header = {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,PUT',
        "Content-Type": "application/json",
      }


export const handler = async (event) => {
  const req_body = JSON.parse(event.body);

  const d_id = event?.pathParameters?.device_id
  const d_type = req_body['device_type']
  const status_to = req_body['status_to'] ?? {}

  if (d_id === undefined) {
    return {
      statusCode: 404,
      headers: header,
      body: JSON.stringify({
        message: "device id not found"
      })
    }
  }

  if (status_to['is_active'] === undefined) {
    return {
      statusCode: 400,
      headers: header,
      body: JSON.stringify({
        message: "not valid state: is_active"
      })
    }
  }
  if (d_type === 1 && status_to['step'] === undefined) {
    return {
      statusCode: 400,
      headers: header,
      body: JSON.stringify({
        message: "not valid state: step"
      })
    }
  }

  const newState = {
    "desired": {
      ...status_to,
      'device_id': d_id,
      'type': 'device'
    }
  }

  const updateCommand = new UpdateThingShadowCommand({
    'thingName': d_id,
    payload: JSON.stringify({state: newState})
  })
  let result;
  // 디바이스 섀도우를 업데이트
  try {
    result = await iot.send(updateCommand);
  } catch (error) {
    console.error('Error updating device shadow:', error);
  }

  return {
    statusCode: 200,
    headers: header,
    body: JSON.stringify({
      message: newState,
    }),
  };
};
