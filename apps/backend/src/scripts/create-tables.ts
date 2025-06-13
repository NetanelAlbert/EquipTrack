import { TableCreator } from '../db/scripts/create-tables';

async function main() {
  const creator = new TableCreator();
  try {
    await creator.createTables();
    console.log('All tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

main();
