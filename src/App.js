import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import GaugeChart from 'react-gauge-chart';
import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => {
  const [led1Status, setLed1Status] = useState('Loading...');
  const [led2Status, setLed2Status] = useState('Loading...');
  const [led3Status, setLed3Status] = useState('Loading...');
  const [luxValue, setLuxValue] = useState(0);
  const [pirValue, setPirValue] = useState('Loading...');
  const [rssiValue, setRssiValue] = useState('Loading...');
  const [threshold, setThreshold] = useState(50);
  const [client, setClient] = useState(null);
  const [activeMode, setActiveMode] = useState(0); 

  useEffect(() => {
    const clientId = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    const mqttClient = mqtt.connect('wss://9bf62adad86549a3a08bd830a5735042.s1.eu.hivemq.cloud:8884/mqtt', {
      clientId: clientId,
      username: 'firedetect',
      password: 'Fire1234',
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    });

    mqttClient.on('connect', () => {
      console.log('Connected to MQTT broker');
      mqttClient.subscribe('data', (err) => {
        if (!err) {
          console.log('Subscribed to topic "data"');
        }
      });
    });

    mqttClient.on('message', (topic, message) => {
      if (topic === 'data') {
        const data = parseData(message.toString());
        updateDashboard(data);
      }
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, []);

  const parseData = (dataString) => {
    const data = {};
    const pairs = dataString.split(',');
    pairs.forEach(pair => {
      const [key, value] = pair.split(':');
      data[key.trim()] = value.trim();
    });
    return data;
  };

  const updateDashboard = (data) => {
    if (data.led1 !== undefined) setLed1Status(data.led1);
    if (data.led2 !== undefined) setLed2Status(data.led2);
    if (data.led3 !== undefined) setLed3Status(data.led3);
    if (data.lux !== undefined) setLuxValue(parseInt(data.lux));
    if (data.pir !== undefined) setPirValue(data.pir);
    if (data.rssi !== undefined) setRssiValue(data.rssi);
    if (data.threshold !== undefined) {
      setThreshold(parseInt(data.threshold));
    }
    if (data.mode !== undefined) {
      setActiveMode(parseInt(data.mode));
    }
  };

  const controlDevice = (device, state) => {
    let updatedLed1 = led1Status;
    let updatedLed2 = led2Status;
    let updatedLed3 = led3Status;

    if (device === 'led1') updatedLed1 = state;
    if (device === 'led2') updatedLed2 = state;
    if (device === 'led3') updatedLed3 = state;

    const command = `mode:0,led1:${updatedLed1},led2:${updatedLed2},led3:${updatedLed3}`;

    if (client) {
      client.publish('control', command, { qos: 0, retain: false }, (error) => {
        if (error) {
          console.error('Error publishing message:', error);
        } else {
          console.log('Command published:', command);
        }
      });
    }
  };

  const setMode = (mode) => {
    let command;
    if (mode === 0) {
      command = `mode:0,led1:${led1Status},led2:${led2Status},led3:${led3Status}`;
    } else if (mode === 1) {
      command = `mode:1,lux:${threshold},pir:1`;
    }

    setActiveMode(mode);

    if (client) {
      client.publish('control', command, { qos: 0, retain: false }, (error) => {
        if (error) {
          console.error('Error publishing message:', error);
        } else {
          console.log('Command published:', command);
        }
      });
    }
  };

  const gaugeConfig = {
    lux: {
      colors: ["#ff0000", "#ffff00", "#00ff00"],
      arcWidth: 0.3,
      textColor: "#000000",
      max: 4096,
      label: "Ánh sáng (Lux)"
    },
    pir: {
      colors: ["#ff0000", "#00ff00"],
      arcWidth: 0.3,
      textColor: "#000000",
      max: 1,
      label: "Chuyển động (PIR)"
    },
    rssi: {
      colors: ["#00ff00", "#ffff00", "#ff0000"],
      arcWidth: 0.3,
      textColor: "#000000",
      max: -100,
      label: "Tín hiệu (RSSI)"
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'on') {
      return <span className="badge bg-success">BẬT</span>;
    } else if (status === 'off') {
      return <span className="badge bg-danger">TẮT</span>;
    } else {
      return <span className="badge bg-secondary">{status}</span>;
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <a className="navbar-brand" href="/">IoT Dashboard</a>
          <span className="navbar-text ms-auto text-white">
            {client ? 
              <span className="badge bg-success">Đã kết nối</span> : 
              <span className="badge bg-danger">Đang kết nối...</span>
            }
          </span>
        </div>
      </nav>

      <div className="container mt-4">
        <div className="row">
          {/* Device Status Card */}
          <div className="col-md-6 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">Trạng thái thiết bị</h5>
              </div>
              <div className="card-body">
                <table className="table table-hover">
                  <tbody>
                    <tr>
                      <th style={{width: '30%'}}>LED 1</th>
                      <td style={{width: '30%'}}>{getStatusBadge(led1Status)}</td>
                      <td style={{width: '40%'}}>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-success" onClick={() => controlDevice('led1', 'on')} 
                                  disabled={activeMode !== 0}>BẬT</button>
                          <button className="btn btn-danger" onClick={() => controlDevice('led1', 'off')} 
                                  disabled={activeMode !== 0}>TẮT</button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th>LED 2</th>
                      <td>{getStatusBadge(led2Status)}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-success" onClick={() => controlDevice('led2', 'on')} 
                                  disabled={activeMode !== 0}>BẬT</button>
                          <button className="btn btn-danger" onClick={() => controlDevice('led2', 'off')} 
                                  disabled={activeMode !== 0}>TẮT</button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th>LED 3</th>
                      <td>{getStatusBadge(led3Status)}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-success" onClick={() => controlDevice('led3', 'on')} 
                                  disabled={activeMode !== 0}>BẬT</button>
                          <button className="btn btn-danger" onClick={() => controlDevice('led3', 'off')} 
                                  disabled={activeMode !== 0}>TẮT</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                
                <div className="mt-4">
                  <h6 className="mb-3">Chế độ hoạt động</h6>
                  <div className="btn-group w-100">
                    <button 
                      className={`btn ${activeMode === 0 ? 'btn-primary' : 'btn-outline-primary'}`} 
                      onClick={() => setMode(0)}>
                      Chế độ thủ công
                    </button>
                    <button 
                      className={`btn ${activeMode === 1 ? 'btn-primary' : 'btn-outline-primary'}`} 
                      onClick={() => setMode(1)}>
                      Chế độ tự động
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sensors Card */}
          <div className="col-md-6 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">Dữ liệu cảm biến</h5>
              </div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-12 mb-4">
                    <h6 className="text-center">{gaugeConfig.lux.label}</h6>
                    <GaugeChart 
                      id="lux-gauge" 
                      nrOfLevels={20} 
                      colors={gaugeConfig.lux.colors}
                      arcWidth={gaugeConfig.lux.arcWidth}
                      textColor={gaugeConfig.lux.textColor}
                      percent={Math.min(luxValue / gaugeConfig.lux.max, 1)}
                      formatTextValue={() => `${luxValue} Lux`}
                    />
                  </div>
                  <div className="col-6 mb-3">
                    <h6 className="text-center">{gaugeConfig.pir.label}</h6>
                    <GaugeChart 
                      id="pir-gauge" 
                      nrOfLevels={2} 
                      colors={gaugeConfig.pir.colors}
                      arcWidth={gaugeConfig.pir.arcWidth}
                      textColor={gaugeConfig.pir.textColor}
                      percent={pirValue === '1' ? 1 : 0}
                      formatTextValue={() => pirValue === '1' ? 'Có chuyển động' : 'Không có'}
                    />
                  </div>
                  <div className="col-6 mb-3">
                    <h6 className="text-center">{gaugeConfig.rssi.label}</h6>
                    <GaugeChart 
                      id="rssi-gauge" 
                      nrOfLevels={10} 
                      colors={gaugeConfig.rssi.colors}
                      arcWidth={gaugeConfig.rssi.arcWidth}
                      textColor={gaugeConfig.rssi.textColor}
                      percent={Math.min(Math.abs(parseInt(rssiValue) || 0) / 100, 1)}
                      formatTextValue={() => `${rssiValue} dBm`}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor="threshold" className="form-label fw-bold">Ngưỡng ánh sáng</label>
                  <div className="d-flex align-items-center">
                    <input 
                      type="range" 
                      className="form-range me-2" 
                      id="threshold" 
                      min="0" 
                      max="4096" 
                      value={threshold} 
                      onChange={(e) => setThreshold(parseInt(e.target.value))} 
                      // disabled={activeMode !== 1}
                      style={{flex: "1"}}
                    />
                    <span className="badge bg-primary" style={{width: "60px"}}>{threshold}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small>0</small>
                    <small>2048</small>
                    <small>4096</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
