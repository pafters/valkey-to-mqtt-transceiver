import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('modems')
export class Modem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500, nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: false })
  guid: string;

  @Column({ type: 'int4', nullable: false })
  template_id: number;

  @Column({ type: 'int4', nullable: false })
  alias_template_id: number;

  @Column({ type: 'int4', nullable: false })
  server_alias_template_id: number;

  @Column({ type: 'int4', nullable: false })
  site_id: number | null;
}
