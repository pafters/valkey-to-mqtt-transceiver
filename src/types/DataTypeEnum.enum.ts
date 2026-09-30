export enum DataTypeEnum {
  // используемые в сервисе
  uint16 = 2,
  flags = 6,
  enum = 9,
  unixtime = 10,
  bits = 12,
  CSUVer = 13,
  IPAddress = 16,

  // остальные
  int16 = 1,
  float = 3,
  bool = 4,
  string = 5,
  int32 = 7,
  uint32 = 8,
  link = 11,
  StateAndColor = 14,
  InterEnumUnitScale = 15,
  InterTags = 17,
}
