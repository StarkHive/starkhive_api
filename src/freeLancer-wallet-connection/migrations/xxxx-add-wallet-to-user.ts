import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddWalletToUser1234567890123 implements MigrationInterface {
  name = 'AddWalletToUser1234567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add wallet_address column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'wallet_address',
        type: 'varchar',
        length: '42',
        isNullable: true,
        isUnique: true,
        comment: 'Cryptocurrency wallet address - read-only after initial save',
      }),
    );

    // Add wallet_connected_at column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'wallet_connected_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'Timestamp when wallet was first connected',
      }),
    );

    // Create unique index on wallet_address
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_wallet_address',
        columnNames: ['wallet_address'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.dropIndex('users', 'idx_wallet_address');

    // Drop columns
    await queryRunner.dropColumn('users', 'wallet_connected_at');
    await queryRunner.dropColumn('users', 'wallet_address');
  }
}
