import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient();

export const handler = async (event) => {
    const u_id = event.requestContext.authorizer.claims.sub
    const req_body = JSON.parse(event.body)
    const device_id = event?.pathParameters?.device_id ?? ""
    const isQueried = (device_id !== "")
  
  const params = {
    TableName: 'IoTPlat_Device',
    FilterExpression: 'user_id = :userId',
    ExpressionAttributeValues: {
      ':userId': { S: u_id }
    }
  };

  try {
    const scanCommand = new ScanCommand(params);
    const result = await dynamodb.send(scanCommand);
      
    if (isQueried) {
      let item = null
      for (const dvc of result.Items) {
        if (dvc.device_id.S === device_id) {
          item = dvc
          break
        }
      }
      if (item === null) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET'
          },
          body: JSON.stringify({
            description: "Not Found",
          })
        };
      }
     
      
      const d_state_params = {
        TableName: 'IoTPlat_DeviceStatus',
        KeyConditionExpression: 'device_id = :deviceId',
        ExpressionAttributeValues: {
          ':deviceId': {
            S: device_id
          }
        },
        ScanIndexForward: false, // 역순
        Limit: 1
      };

      let deviceStatusResult = null
      try {
        deviceStatusResult = await dynamodb.send(new QueryCommand(d_state_params))
      }
      catch(e) {console.log("No data!")}
      let deviceStatus = {}
      
      if (deviceStatusResult.Items[0] !== undefined) {
        const dbDeviceStatus = deviceStatusResult.Items[0]
        switch(parseInt(item.device_type.N)) {
          case 0:
            deviceStatus['is_active'] = dbDeviceStatus.is_active.BOOL
          case 1: 
            deviceStatus['step'] = dbDeviceStatus.step.N
            break
          default:
            console.log(`unknown type : ${item.device_type.N}`)
            break
            
        }
      }


      return {
        statusCode: 200,
        headers: {
              'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET'
          },
        body: JSON.stringify({ 
          description: "OK",
          device: {
            id: item.device_id.S,
            name: item.device_name.S,
            description: item.device_description.S,
            power: item.device_power.N,
            type: item.device_type.N,
            status: deviceStatus
          }
        })
      };
    }
    

    // 가져온 데이터 처리
    const items = await Promise.all(result.Items.map(async (item) => {
      const d_state_params = {
        TableName: 'IoTPlat_DeviceStatus',
        KeyConditionExpression: 'device_id = :deviceId',
        ExpressionAttributeValues: {
          ':deviceId': {
            S: item.device_id.S
          }
        }, 
        ScanIndexForward: false, // 역순
        Limit: 1
      }
      
      let deviceStatusResult = null
      try {
        deviceStatusResult = await dynamodb.send(new QueryCommand(d_state_params))
      }
      catch(e) {console.log(`No Data: id ${e}`)}
      let deviceStatus = {}
      
      if (deviceStatusResult.Items[0] !== undefined) {
        const dbDeviceStatus = deviceStatusResult.Items[0]
        switch(parseInt(item.device_type.N)) {
          case 0:
            deviceStatus['is_active'] = dbDeviceStatus.is_active.BOOL
          case 1: 
            deviceStatus['step'] = dbDeviceStatus.step.N
            break
          default:
            console.log(`unknown type : ${item.device_type.N}`)
            break
            
        }
      }

      return {
        id: item.device_id.S,
        name: item.device_name.S,
        description: item.device_description.S,
        power: item.device_power.N,
        type: item.device_type.N,
        status: deviceStatus
      };
    }));

    return {
      statusCode: 200,
      headers: {
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET'
        },
      body: JSON.stringify({ 
        description: "OK",
        devices: items
      })
    };
  } catch (error) {
    console.error('Error retrieving items:', error);

    return {
      statusCode: 500,
      headers: {
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET'
        },
      body: JSON.stringify({ message: 'Internal Server Error(getDevice)' })
    };
  }
};