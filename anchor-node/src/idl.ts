import { type Address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";

/**
 * The Anchor IDL structure - matches Anchor's IDL format exactly
 * This allows seamless migration from Anchor TypeScript to Gill
 */
export interface Idl {
  address: string;
  metadata: IdlMetadata;
  instructions: IdlInstruction[];
  accounts?: IdlAccount[];
  events?: IdlEvent[];
  errors?: IdlErrorCode[];
  types?: IdlTypeDef[];
  constants?: IdlConstant[];
}

export interface IdlMetadata {
  name: string;
  version: string;
  spec: string;
  description?: string;
}

/**
 * Instruction definition in the IDL
 */
export interface IdlInstruction {
  name: string;
  docs?: string[];
  accounts: IdlInstructionAccountItem[];
  args: IdlField[];
  returns?: IdlType;
  discriminator?: IdlDiscriminator;
}

/**
 * Account item in an instruction - can be a single account or composite accounts
 */
export type IdlInstructionAccountItem = IdlInstructionAccount | IdlInstructionAccounts;

/**
 * Single account in an instruction
 */
export interface IdlInstructionAccount {
  name: string;
  docs?: string[];
  writable?: boolean;
  signer?: boolean;
  optional?: boolean;
  address?: string;
  pda?: IdlPda;
  relations?: string[];
}

/**
 * Composite accounts (nested structure)
 */
export interface IdlInstructionAccounts {
  name: string;
  docs?: string[];
  accounts: IdlInstructionAccountItem[];
}

/**
 * Program Derived Address specification
 */
export interface IdlPda {
  seeds: IdlSeed[];
  program?: IdlSeed;
}

/**
 * Seed for PDA derivation
 */
export interface IdlSeed {
  kind: "const" | "arg" | "account";
  value?: any;
  path?: string;
}

/**
 * Account state definition
 */
export interface IdlAccount {
  name: string;
  docs?: string[];
  discriminator?: IdlDiscriminator;
  type: IdlTypeDefTyStruct;
}

/**
 * Event definition
 */
export interface IdlEvent {
  name: string;
  discriminator?: IdlDiscriminator;
  type: IdlTypeDefTyStruct;
}

/**
 * Error code definition
 */
export interface IdlErrorCode {
  code: number;
  name: string;
  msg?: string;
}

/**
 * Custom type definition
 */
export interface IdlTypeDef {
  name: string;
  docs?: string[];
  type: IdlTypeDefTy;
}

/**
 * Type definition body
 */
export type IdlTypeDefTy = IdlTypeDefTyStruct | IdlTypeDefTyEnum;

export interface IdlTypeDefTyStruct {
  kind: "struct";
  fields: IdlField[];
}

export interface IdlTypeDefTyEnum {
  kind: "enum";
  variants: IdlEnumVariant[];
}

/**
 * Field in a struct
 */
export interface IdlField {
  name: string;
  docs?: string[];
  type: IdlType;
}

/**
 * Enum variant
 */
export interface IdlEnumVariant {
  name: string;
  fields?: IdlEnumFields;
}

export type IdlEnumFields = IdlField[] | IdlType[];

/**
 * Constants in the IDL
 */
export interface IdlConstant {
  name: string;
  type: IdlType;
  value: string;
}

/**
 * Discriminator for accounts/instructions/events
 */
export type IdlDiscriminator = number[];

/**
 * Type system for IDL
 */
export type IdlType = IdlTypePrimitive | IdlTypeVec | IdlTypeOption | IdlTypeArray | IdlTypeDefined | IdlTypeGeneric;

// Primitive types
export type IdlTypePrimitive =
  | "bool"
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "f32"
  | "u64"
  | "i64"
  | "f64"
  | "u128"
  | "i128"
  | "u256"
  | "i256"
  | "bytes"
  | "string"
  | "pubkey";

// Vec type
export interface IdlTypeVec {
  vec: IdlType;
}

// Option type
export interface IdlTypeOption {
  option: IdlType;
}

// Array type
export interface IdlTypeArray {
  array: [IdlType, number];
}

// Defined/custom type
export interface IdlTypeDefined {
  defined: {
    name: string;
    generics?: IdlTypeGeneric[];
  };
}

// Generic type
export interface IdlTypeGeneric {
  generic: string;
}

/**
 * Type guards for IDL types
 */
export function isCompositeAccounts(accountItem: IdlInstructionAccountItem): accountItem is IdlInstructionAccounts {
  return "accounts" in accountItem;
}

export function isIdlTypeVec(type: IdlType): type is IdlTypeVec {
  return typeof type === "object" && "vec" in type;
}

export function isIdlTypeOption(type: IdlType): type is IdlTypeOption {
  return typeof type === "object" && "option" in type;
}

export function isIdlTypeArray(type: IdlType): type is IdlTypeArray {
  return typeof type === "object" && "array" in type;
}

export function isIdlTypeDefined(type: IdlType): type is IdlTypeDefined {
  return typeof type === "object" && "defined" in type;
}

export function isIdlTypeGeneric(type: IdlType): type is IdlTypeGeneric {
  return typeof type === "object" && "generic" in type;
}

/**
 * Utility function to get program address from IDL
 */
export function getProgramAddress(idl: Idl): Address {
  return idl.address as Address;
}

/**
 * Utility to convert camelCase to snake_case for Rust compatibility
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Utility to convert snake_case to camelCase for TypeScript
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert IDL to camelCase for TypeScript usage (like Anchor does)
 */
export function convertIdlToCamelCase<T extends Idl>(idl: T): T {
  // This is a simplified version - in practice this would be a deep transformation
  // of all names in the IDL from snake_case to camelCase
  return {
    ...idl,
    instructions: idl.instructions.map((ix) => ({
      ...ix,
      name: toCamelCase(ix.name),
      accounts: ix.accounts.map(convertAccountItemToCamelCase),
      args: ix.args.map((arg) => ({
        ...arg,
        name: toCamelCase(arg.name),
      })),
    })),
    accounts: idl.accounts?.map((acc) => ({
      ...acc,
      name: toCamelCase(acc.name),
    })),
    // ... other fields would be converted too
  } as T;
}

function convertAccountItemToCamelCase(item: IdlInstructionAccountItem): IdlInstructionAccountItem {
  if (isCompositeAccounts(item)) {
    return {
      ...item,
      name: toCamelCase(item.name),
      accounts: item.accounts.map(convertAccountItemToCamelCase),
    };
  } else {
    return {
      ...item,
      name: toCamelCase(item.name),
    };
  }
}

/**
 * Address utility function for IDL program addresses
 */
export async function idlAddress(programId: Address): Promise<Address> {
  // Seeds: ["anchor:idl", programId] - exactly like Anchor
  const seeds = [new TextEncoder().encode("anchor:idl"), getAddressEncoder().encode(programId)];

  const [pda] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds,
  });

  return pda;
}

/**
 * Type for extracting instruction names from an IDL
 */
export type InstructionNames<T extends Idl> = T["instructions"][number]["name"];

/**
 * Type for extracting account names from an IDL
 */
export type AccountNames<T extends Idl> = T["accounts"] extends readonly any[] ? T["accounts"][number]["name"] : never;

/**
 * Type for extracting event names from an IDL
 */
export type EventNames<T extends Idl> = T["events"] extends readonly any[] ? T["events"][number]["name"] : never;
