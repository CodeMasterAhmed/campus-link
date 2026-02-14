export type UUID = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}
