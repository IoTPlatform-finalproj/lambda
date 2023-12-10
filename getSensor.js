import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient();

const header = {
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET',
          'Content-Type': 'application/json'
        }

export const handler = async (event) => {
    const u_id = event.requestContext.authorizer.claims.sub
    const sensor_id = event?.pathParameters?.sensor_id ?? ""
    const isQueried = (sensor_id !== "")
  
  const params = {
    TableName: 'IoTPlat_Sensor',
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
        if (dvc.sensor_id.S === sensor_id) {
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
        TableName: 'IoTPlat_SensorStatus',
        KeyConditionExpression: 'sensor_id = :sensorId',
        ExpressionAttributeValues: {
          ':sensorId': {
            S: sensor_id
          }
        },
        ScanIndexForward: false, // 역순
        Limit: 1
      };

      let sensorStatusResult = null
      try {
        sensorStatusResult = await dynamodb.send(new QueryCommand(d_state_params))
      }
      catch (e) { console.log(`No data: ${sensor_id}`); console.error(e)}
      let sensorStatus = {}
      
      if (sensorStatusResult.Items[0] !== undefined) {
        const dbSensorStatus = sensorStatusResult.Items[0]
        switch(parseInt(item.sensor_type.N)) {
          case 0:
            sensorStatus['is_on'] = dbSensorStatus.is_on
            break
          case 1: 
            sensorStatus['value'] = dbSensorStatus.value
            break
          default:
            console.log(`unknown type : ${item.sensor_type.N}`)
            break
            
        }
      }


      return {
        statusCode: 200,
        headers: header,
        body: JSON.stringify({ 
          description: "OK",
          sensor: {
            id: item.sensor_id.S,
            name: item.sensor_name.S,
            description: item.sensor_description.S, 
            type: item.sensor_type.N,
            status: sensorStatus
          }
        })
      };
    }
    

    // 가져온 데이터 처리
    const items = await Promise.all(result.Items.map(async (item) => {
      const d_state_params = {
        TableName: 'IoTPlat_SensorStatus',
        KeyConditionExpression: 'sensor_id = :sensorId',
        ExpressionAttributeValues: {
          ':sensorId': {
            S: item.sensor_id.S
          }
        }, 
        ScanIndexForward: false, // 역순
        Limit: 1
      }
      
      let sensorStatusResult = null
      try {
        sensorStatusResult = await dynamodb.send(new QueryCommand(d_state_params))
      }
      catch(e) {console.log(`No Data: id ${e}`)}
      let sensorStatus = {}
      
      if (sensorStatusResult.Items[0] !== undefined) {
        const dbSensorStatus = sensorStatusResult.Items[0]
        switch(parseInt(item.sensor_type.N)) {
          case 0:
            sensorStatus['is_on'] = dbSensorStatus.is_on
            break
          case 1: 
            sensorStatus['value'] = dbSensorStatus.value
            break
          default:
            console.log(`unknown type : ${item.sensor_type.N}`)
            break
            
        }
      }

      return {
        id: item.sensor_id.S,
        name: item.sensor_name.S,
        description: item.sensor_description.S, 
        type: item.sensor_type.N,
        status: sensorStatus
      };
    }));

    return {
      statusCode: 200,
      headers: header,
      body: JSON.stringify({ 
        description: "OK",
        sensors: items
      })
    };
  } catch (error) {
    console.error('Error retrieving items:', error);

    return {
      statusCode: 500,
      headers: header,
      body: JSON.stringify({ message: 'Internal Server Error(getSensor)' })
    };
  }
};