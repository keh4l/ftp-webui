import type { Connection, CreateConnectionInput } from "./model";

export interface ConnectionRepository {
  init(): void;
  create(input: CreateConnectionInput): Connection;
  list(): Connection[];
}
