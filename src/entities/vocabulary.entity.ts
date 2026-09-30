import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vocabulary')
export class Vocabulary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  word: string;

  @Column({ type: 'varchar', nullable: false })
  lang: string;

  @Column({ type: 'varchar', nullable: false })
  translation: string;
}
