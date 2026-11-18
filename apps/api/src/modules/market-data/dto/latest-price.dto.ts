import { IsOptional, IsString, Matches } from "class-validator";
export class LatestPriceQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]+$/)
  symbol?: string;
}
