import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';

export type SatpDataMapType = {
  [alias: string]: ServerAliasTemplateParameters;
};
