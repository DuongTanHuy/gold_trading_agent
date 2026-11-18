import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
export class CandlesQueryDto {
  @IsOptional() @IsString() symbol = "XAUUSD";
  @IsIn(["M1", "M5", "M15", "H1", "H4", "D1"]) timeframe:
    | "M1"
    | "M5"
    | "M15"
    | "H1"
    | "H4"
    | "D1" = "M5";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) limit = 500;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
