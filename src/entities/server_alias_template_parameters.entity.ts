import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('server_alias_template_parameters')
export class ServerAliasTemplateParameters {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int4', nullable: false })
  server_alias_template_id: number;

  @Column({ type: 'varchar', nullable: false, default: 'default' })
  device_alias: string;

  @Column({ type: 'varchar', nullable: false, default: 'default' })
  alias: string;

  @Column({
    type: 'int',
    nullable: false,
    default: 1,
  })
  server_data_type_id: number;

  @Column({ type: 'int', nullable: false })
  first_bit: number;

  @Column({ type: 'int', nullable: false })
  last_bit: number;

  @Column({ type: 'varchar', nullable: true, default: null })
  value_interpretation?: string;

  @Column({ type: 'float', nullable: false, default: 1 })
  coef_k: number;

  @Column({ type: 'float', nullable: false, default: 0 })
  coef_b: number;

  @Column({ type: 'int', nullable: false, default: 2 })
  qos: number;

  @Column({ type: 'int', nullable: false, default: 0 })
  mask: number;

  @Column({
    type: 'float',
    nullable: false,
    default: 0,
  })
  deadband_value: number;

  @Column({
    type: 'float',
    nullable: false,
    default: 0,
  })
  deadband_percent: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  deadband_time_sec: number;

  @Column({ type: 'double precision', nullable: false })
  alarm_lower: number;

  @Column({ type: 'double precision', nullable: false })
  alarm_higher: number;

  @Column({ type: 'varchar', nullable: true, default: null })
  alarm_equal?: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  alarm_bits?: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  description?: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  eu?: string;

  @Column({ type: 'bool', nullable: true, default: false })
  is_set?: boolean;

  @Column({
    name: 'event_pattern',
    type: 'varchar',
    nullable: true,
    default: '',
  })
  eventPattern?: string;

  @Column({
    name: 'mqtt_outgoing_alias',
    type: 'varchar',
    nullable: true,
    default: null,
  })
  mqtt_outgoing_alias?: string;
}
