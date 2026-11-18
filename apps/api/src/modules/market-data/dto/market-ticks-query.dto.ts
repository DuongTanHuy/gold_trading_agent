import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
export class MarketTicksQueryDto {
  @IsOptional() @IsString() symbol = "XAUUSD";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit = 100;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
