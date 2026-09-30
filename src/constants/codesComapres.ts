import { CodeCompareType } from 'src/types/CodeCompare.type';
import { DATA_TYPE_VARNUMBER_TYPE_LIST } from './dataTypeVarnumberTypeList';
import { DataTypeEnum } from 'src/types/DataTypeEnum.enum';

const CODE_COMPARE_CONFIG: CodeCompareType[] = [
  {
    topicIRZ: [{ alias: '4x00ff__work_mode_raw', type: 'device' }],
    tagnameNIS: 'VFD/SwitchStatus',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    formula: function (deviceId, values) {
      if (values?.['4x00ff__work_mode_raw'].value === 0) {
        return 0; // Position 0 (off)
      }
      if (values?.['4x00ff__work_mode_raw'].value === 1) {
        return 32; // Position: Manual mode
      }
      if (values?.['4x00ff__work_mode_raw'].value === 2) {
        return 16; // Position: Automatic mode
      }
      return null;
    },
  },
  {
    topicIRZ: [{ alias: '4x013C Pump_fillage', type: 'device' }],
    tagnameNIS: 'VFD/PumpOffControlStatus',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.float
    ] as number,
    formula: function (deviceId, values) {
      const result = values?.['4x013C Pump_fillage'].value;
      return result;
    },
  },
  {
    topicIRZ: [{ alias: 'Modem_link', type: 'modem' }],
    tagnameNIS: 'VFD/NumberOfEventsWaxing',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    formula: function () {
      return 0;
    },
  },
  {
    topicIRZ: [
      { alias: '4x00ff__work_mode_raw', type: 'device' },
      { alias: '4x00FF__current_motor_state_raw', type: 'device' },
      { alias: 'Modem_link', type: 'modem' },
      { alias: '4x0907__stat_Last_stop_reason_raw', type: 'device' },
    ],
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    tagnameNIS: 'VFD/VFDStatus',
    formula: function (deviceId, values) {
      const modemLinkValue = Boolean(values['Modem_link'].value);
      const workModeValue = Number(values['4x00ff__work_mode_raw'].value);
      const currentMotorStateValue = Number(
        values['4x00FF__current_motor_state_raw'].value,
      );
      const lastStopReasonValue = Number(
        values['4x0907__stat_Last_stop_reason_raw'].value,
      );

      if (Boolean(modemLinkValue) !== true) {
        return 0; //1 - Communication failure
      }

      if (workModeValue === 2 && currentMotorStateValue === 2) {
        return 1; //2 - Running in auto mode
      }
      if (workModeValue === 1 && currentMotorStateValue === 2) {
        return 2; //3 -  Running in manual mode
      }
      if (
        workModeValue === 2 &&
        (currentMotorStateValue === 1 || currentMotorStateValue === 2)
      ) {
        return 3; //4 - Stopped in auto mode
      }
      if (
        workModeValue === 1 &&
        (currentMotorStateValue === 1 || currentMotorStateValue === 2)
      ) {
        return 4; //5 - Stopped in manual mode
      }
      const possibleFailedValues = new Set<number>([
        0x8010, 0x8017, 0x80a0, 0x80a3, 0x80a8, 0x80ee, 0x80f8, 0x819f, 0x8200,
        0x8201, 0x8202, 0x8300, 0x8302, 0x8303, 0x8304, 0x8305, 0x8306, 0x8307,
        0x8308, 0x8309, 0x830a, 0x830b, 0x830c, 0x830d, 0x830e, 0x830f, 0x8310,
        0x8311, 0x8312, 0x8313, 0x8314, 0x8315, 0x8316, 0x8317, 0x8318, 0x8319,
        0x831a, 0x831b, 0x831c, 0x831d, 0x831e, 0x822e, 0x822f, 0x8230, 0x8215,
        0x8216, 0x8217, /* copy from 0x8***  */ 0x0010, 0x0017, 0x00a0, 0x00a3,
        0x00a8, 0x00ee, 0x00f8, 0x019f, 0x0200, 0x0201, 0x0202, 0x0300, 0x0302,
        0x0303, 0x0304, 0x0305, 0x0306, 0x0307, 0x0308, 0x0309, 0x030a, 0x030b,
        0x030c, 0x030d, 0x030e, 0x030f, 0x0310, 0x0311, 0x0312, 0x0313, 0x0314,
        0x0315, 0x0316, 0x0317, 0x0318, 0x0319, 0x031a, 0x031b, 0x031c, 0x031d,
        0x031e, 0x022e, 0x022f, 0x0230, 0x0215, 0x0216, 0x0217,
      ]);
      const possibleJammedValues = new Set<number>([
        0x80a4, 0x80a5, 0x80a9, 0x00a4, 0x00a5, 0x00a9,
      ]);
      const possibleManuallyValues = new Set<number>([
        0x8066, 0x8067, 0x8068, 0x0066, 0x0067, 0x0068,
      ]);
      const possibleAutoRestartValues = new Set<number>([
        0x0001, 0x0002, 0x0003,
      ]);
      const cylinderFillingValues = new Set<number>([0x80a1, 0x00a1]);
      const frequencyRammingValues = new Set<number>([0x821a, 0x021a]);
      const pressureBelowMinimalValues = new Set<number>([0x8080, 0x0080]);

      if (
        (workModeValue === 1 || workModeValue === 0) &&
        possibleFailedValues.has(lastStopReasonValue)
      ) {
        return 5; //6 - Stopped due equipment failure trip*
      }
      if (
        (workModeValue === 1 || workModeValue === 0) &&
        possibleJammedValues.has(lastStopReasonValue)
      ) {
        return 6; //6 - Stopped - Jammed
      }
      if (
        (workModeValue === 1 || workModeValue === 0) &&
        cylinderFillingValues.has(lastStopReasonValue)
      ) {
        return 8; // Stopped - Cylinder filling
      }
      if (
        (workModeValue === 1 || workModeValue === 0) &&
        frequencyRammingValues.has(lastStopReasonValue)
      ) {
        return 10; // Stopped - Frequency ramping
      }
      if (
        workModeValue === 2 &&
        possibleAutoRestartValues.has(lastStopReasonValue)
      ) {
        return 11; // Auto restart
      }
      if (
        (workModeValue === 1 || workModeValue === 0) &&
        pressureBelowMinimalValues.has(lastStopReasonValue)
      ) {
        return 14; // Stopped - Pressure below minimum
      }
      if (
        (workModeValue === 1 || workModeValue === 0) &&
        possibleManuallyValues.has(lastStopReasonValue)
      ) {
        return 15; // Stopped - Manual stopped
      }
      const startReasonCodeSet = new Set<number>([
        0x00f0, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x000d,
        0x000e, 0x000f, 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016,
        0x0017,
      ]);
      if (
        (workModeValue === 1 || workModeValue === 0) &&
        startReasonCodeSet.has(lastStopReasonValue) === false
      ) {
        return 6; // Default code, for error work
      }

      return null;
    },
  },
  {
    topicIRZ: [{ alias: 'Modem_link', type: 'modem' }],
    tagnameNIS: 'DEV/CommunicationStatus',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    formula: function (deviceId, values) {
      if (Boolean(values?.Modem_link?.value) === true) {
        return 1;
      } else {
        return 0;
      }
    },
  },
  {
    topicIRZ: [
      { alias: '4x0145 Qcalc_Current_Day', type: 'device' },
      { alias: '4x1967__q_today_plan', type: 'device' },
    ],
    tagnameNIS: 'DEV/PumpVolumetricEfficiency',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    formula: function (deviceId, values) {
      const value1 = values?.['4x0145 Qcalc_Current_Day']?.value;
      const value2 = values?.['4x1967__q_today_plan']?.value;

      if (value1 === undefined || value2 === undefined) {
        return null;
      }
      const result = Number(value1) / Number(value2);

      if (isNaN(result) === true) {
        return null;
      }

      return result;
    },
  },
  {
    topicIRZ: [{ alias: '3x0502 set_Smart_mode', type: 'device' }],
    tagnameNIS: 'VFD/PumpFillAA',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    formula: function (deviceId, values) {
      if (
        values?.['3x0502 set_Smart_mode']?.value === 1 ||
        values?.['3x0502 set_Smart_mode']?.value === 2
      ) {
        return 1;
      }
      if (values?.['3x0502 set_Smart_mode']?.value === 0) {
        return 0;
      }

      return null;
    },
  },
  {
    topicIRZ: [{ alias: '3x0502 set_Smart_mode', type: 'device' }],
    tagnameNIS: 'VFD/PumpFillAS',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.uint16
    ] as number,
    formula: function (deviceId, values) {
      if (values?.['3x0502 set_Smart_mode']?.value === 2) return 1; // mode enabled

      return 0; // mode disable
    },
  },
  {
    topicIRZ: [
      { alias: '4x0124 Analog_input_1_signal', type: 'device' },
      { alias: '3x037B set_Analog_input1_discreteness', type: 'device' },
    ],
    tagnameNIS: 'DEV/Pressure',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.float
    ] as number,
    formula: function (deviceId, values) {
      let valueMultiplayer: number | null = null;
      const multiplayerRawValue =
        values?.['3x037B set_Analog_input1_discreteness']?.value;
      if (multiplayerRawValue === 0) {
        valueMultiplayer = 1;
      } else if (multiplayerRawValue === 1) {
        valueMultiplayer = 0.1;
      } else if (multiplayerRawValue === 2) {
        valueMultiplayer = 0.01;
      } else if (multiplayerRawValue === 3) {
        valueMultiplayer = 0.001;
      }

      if (valueMultiplayer === null) {
        return null;
      }

      const rawValue = values?.['4x0124 Analog_input_1_signal']?.value;
      const resultValue = Number(rawValue) * valueMultiplayer;

      if (Number.isNaN(resultValue) === true) {
        return null;
      }

      return resultValue;
    },
  },
  {
    topicIRZ: [{ alias: '4x1968__power_output_0.1_kW', type: 'device' }],
    tagnameNIS: 'VFD/PowerOut',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.float
    ] as number,
    formula: function (deviceId, values) {
      const value = values?.['4x1968__power_output_0.1_kW']?.value;
      if (typeof value !== 'number' && Number.isNaN(value) === true) {
        return null;
      }
      const result = Number(value);
      return result;
    },
  },
  {
    topicIRZ: [{ alias: '4x1964__torque_out_percent', type: 'device' }],
    tagnameNIS: 'VFD/TorqueOutPercent',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.float
    ] as number,
    formula: function (deviceId, values) {
      const value = values?.['4x1964__torque_out_percent']?.value;
      if (typeof value !== 'number' && Number.isNaN(value) === true) {
        return null;
      }
      const result = Number(value);
      return result;
    },
  },
  {
    topicIRZ: [{ alias: '3x070D_Motor_torque', type: 'device' }],
    tagnameNIS: 'VFD/TorqueOut',
    returningDataType: DATA_TYPE_VARNUMBER_TYPE_LIST[
      DataTypeEnum.int32
    ] as number,
    formula: function (deviceId, values) {
      const rawValue = values?.['3x070D_Motor_torque']?.value;
      if (typeof rawValue !== 'number' && Number.isNaN(rawValue) === true) {
        return null;
      }
      const value = Number(rawValue);
      if (value > 2147483647) {
        const editedValue = value - 4294967296;
        return editedValue;
      }
      return value;
    },
  },
];

export { CODE_COMPARE_CONFIG };
