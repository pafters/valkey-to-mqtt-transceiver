export const buildMqttTopic = ({
  baseTopic,
  postTopic,
  prefix,
}: {
  prefix?: string | null | undefined;
  baseTopic: string;
  postTopic?: string | null | undefined;
}) => {
  const truePrefix =
    prefix === '' || prefix === undefined || prefix === null
      ? ''
      : `${prefix}/`;
  const trueSuffix =
    postTopic === '' || postTopic === undefined || postTopic === null
      ? ''
      : `/${postTopic}`;
  const result = `${truePrefix}${baseTopic}${trueSuffix}`;
  return result;
};
