import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NutritionV2Module } from '../nutrition-v2/nutrition-v2.module';

@Module({
  imports: [NutritionV2Module],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
