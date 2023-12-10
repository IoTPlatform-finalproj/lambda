import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { IoTDataPlaneClient, UpdateThingShadowCommand } from "@aws-sdk/client-iot-data-plane"; // ES Modules import


const iot = new IoTDataPlaneClient({ region: 'us-east-1' });


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

export const handler = async (event) => {
  const type = event.current.state.desired.type ?? ''
  if (type === '') {
    console.log("empty type!")
    return
  }

  const prev = event.previous?.state ?? {}
  const curr = event.current.state
  if (JSON.stringify(prev.reported) === JSON.stringify(curr.reported)) {
    console.log("same data!")
    return
  }

  let command;

  if (type === 'device') {
    const d_id = curr.desired.device_id
    const is_active = curr.reported.is_active
    const step = curr.reported.step ?? null

    command = new PutCommand({
      TableName: 'IoTPlat_DeviceStatus',
      Item: {
        'device_id': d_id,
        'is_active': is_active,
        'step': step,
        'timestamp': Date.now()
      }
    });
  }
  else if (type === 'sensor') {
    const s_id = curr.desired.sensor_id // Must contain in payload
    const is_on = curr.reported.is_on ?? null
    const value = curr.reported.value ?? null

    console.log(`s_id=${s_id}, is_on=${is_on}, value=${value}`)

     command = new PutCommand({
      TableName: 'IoTPlat_SensorStatus',
      Item: {
        'sensor_id': s_id,
        'is_on': is_on,
        'value': value, 
        'timestamp': Date.now()
      }
    })

    // Auto Rule Check
    const getRuleCommand = new ScanCommand({
      TableName: "IoTPlat_AutoRules",
      FilterExpression: "sensor_id = :sid",
      ExpressionAttributeValues: {
        ":sid": s_id
      }
    });

    let getRuleResult = null;
    
    try {
      getRuleResult = await docClient.send(getRuleCommand);
    }
    catch (e) {
      console.error(e)
    }

    let toUpdate = []

    for (const item of getRuleResult.Items) {

      if (checkDesireValue(item.target_value, is_on, value, item.rule_type)) {
        const newState = {
            "desired": {
              ...item.change_to,
              'device_id': item.device_id,
              'type': 'device'
            }
          }

        const updateCommand = new UpdateThingShadowCommand({
          'thingName': item.device_id,
          payload: JSON.stringify({state: newState})
        })
        
        toUpdate.push(updateCommand)
      }
      
    }

    for (const comm of toUpdate) {
      const comLog = await iot.send(comm);
      console.log(comLog)
    }
   
  }

  const dbResponse = await docClient.send(command);
  console.log(dbResponse)
  return;
};

function checkDesireValue(target_value, is_on, value, mode) {
  switch (parseInt(mode)) {
    case 0:
      if (is_on !== null && target_value.is_on !== undefined && target_value.is_on == is_on)
        return true
      else if (value !== null && target_value.value !== undefined && target_value.value == value)
        return true
      break
    case 1:
      if (is_on !== null && target_value.is_on !== undefined && target_value.is_on != is_on)
        return true
      else if (value !== null && target_value.value !== undefined && target_value.value != value)
        return true
      break
    case 2:
      if (value !== null && target_value.value !== undefined && target_value.value > value)
        return true
      break
    case 3:
      if (value !== null && target_value.value !== undefined && target_value.value < value)
        return true
      break
    default:
      return false
  }
  return false
}
