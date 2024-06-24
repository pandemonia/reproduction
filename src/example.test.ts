import { DatabaseDriver, Entity, MikroORM, Opt, PrimaryKey, Property, RequiredEntityData, sql } from '@mikro-orm/sqlite';

@Entity()
class User {

  @PrimaryKey()
  id!: number;

  @Property()
  foo: string[] & Opt = [];

  @Property()
  bar: Date & Opt = new Date();
}

const currentDate = new Date('2024-01-01');
const anotherDate = new Date('2020-02-02');

const inputArray: RequiredEntityData<User>[] = [
  { id: 1 },
  { id: 2, foo: ['test'] },
  { id: 3, bar: anotherDate },
];

const expectedRecords: User[] = [
  { id: 1, foo: [], bar: currentDate },
  { id: 2, foo: ['test'], bar: currentDate },
  { id: 3, foo: [], bar: anotherDate },
];

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.createSchema();

  jest.useFakeTimers();
  jest.setSystemTime(currentDate);
});

afterEach(async () => {
  await orm.em.nativeDelete(User, {}); // Truncate
  orm.em.clear();
})

afterAll(async () => {
  await orm.schema.dropSchema();
  await orm.close(true);
});

test('insert, succeeds', async () => {
  inputArray.map(data => orm.em.create(User, data));
  await orm.em.flush();
  orm.em.clear();

  await expect(orm.em.findAll(User, { orderBy: { id: 'asc' } })).resolves.toEqual(expectedRecords);
});

test('upsert, fails', async () => {
  await Promise.all(inputArray.map(data => orm.em.upsert(User, data)));

  await expect(orm.em.findAll(User, { orderBy: { id: 'asc' } })).resolves.toEqual(expectedRecords);
});

test('upsertMany, fails', async () => {
  await orm.em.upsertMany(User, inputArray);

  await expect(orm.em.findAll(User, { orderBy: { id: 'asc' } })).resolves.toEqual(expectedRecords);
});

test('upsert workaround', async () => {
  // Pass the optional fields' defaults as well, but exclude the fields that should not get updated in the conflict merge
  const defaults = { foo: [], bar: new Date() };
  await Promise.all(inputArray.map(data => orm.em.upsert(
    User,
    { ...defaults, ...data },
    { onConflictExcludeFields: (Object.keys(defaults) as (keyof User)[]).filter(field => !(field in data)) }
  )));

  await expect(orm.em.findAll(User, { orderBy: { id: 'asc' } })).resolves.toEqual(expectedRecords);
});