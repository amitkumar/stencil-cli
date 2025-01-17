const { PassThrough } = require('stream');
const MockWritableStream = require('../../test/_mocks/MockWritableStream');
const NetworkUtils = require('./NetworkUtils');

describe('NetworkUtils', () => {
    afterEach(() => jest.resetAllMocks());
    afterAll(() => jest.restoreAllMocks());

    describe('sendApiRequest', () => {
        const axiosMock = jest.fn();

        it('should call the request library with default options if the passed options have url only', async () => {
            const httpsAgentMock = jest.fn();
            const packageInfoMock = {
                version: '1',
                config: {
                    stencil_version: '2',
                },
            };
            const url = 'https://www.example.com/api/val';

            const networkUtils = new NetworkUtils({
                reqLibrary: axiosMock,
                httpsAgent: httpsAgentMock,
                packageInfo: packageInfoMock,
            });
            await networkUtils.sendApiRequest({ url });

            expect(axiosMock).toHaveBeenCalledWith({
                url,
                httpsAgent: httpsAgentMock,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'x-auth-client': 'stencil-cli',
                    'x-bc-upstream': 'storefront',
                    'stencil-cli': packageInfoMock.version,
                    'stencil-version': packageInfoMock.config.stencil_version,
                },
            });
        });

        it('should call the request library with both default and passed headers if some are passed', async () => {
            const httpsAgentMock = jest.fn();
            const packageInfoMock = {
                version: '1',
                config: {
                    stencil_version: '2',
                },
            };
            const url = 'https://www.example.com/api/val';
            const extraHeaders = {
                'content-type': 'application/json',
            };

            const networkUtils = new NetworkUtils({
                reqLibrary: axiosMock,
                httpsAgent: httpsAgentMock,
                packageInfo: packageInfoMock,
            });
            await networkUtils.sendApiRequest({
                url,
                headers: extraHeaders,
            });

            expect(axiosMock).toHaveBeenCalledWith({
                url,
                httpsAgent: httpsAgentMock,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'content-type': extraHeaders['content-type'],
                    'x-auth-client': 'stencil-cli',
                    'x-bc-upstream': 'storefront',
                    'stencil-cli': packageInfoMock.version,
                    'stencil-version': packageInfoMock.config.stencil_version,
                },
            });
        });

        it('should call the request library with overridden value of the passed headers', async () => {
            const httpsAgentMock = jest.fn();
            const packageInfoMock = {
                version: '1',
                config: {
                    stencil_version: '2',
                },
            };
            const url = 'https://www.example.com/api/val';
            const extraHeaders = {
                'content-type': 'application/json',
                'x-auth-client': 'stencil-cli-new',
                'stencil-cli': 'new',
            };

            const networkUtils = new NetworkUtils({
                reqLibrary: axiosMock,
                httpsAgent: httpsAgentMock,
                packageInfo: packageInfoMock,
            });
            await networkUtils.sendApiRequest({
                url,
                headers: extraHeaders,
            });

            expect(axiosMock).toHaveBeenCalledWith({
                url,
                httpsAgent: httpsAgentMock,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'content-type': extraHeaders['content-type'],
                    'x-auth-client': extraHeaders['x-auth-client'],
                    'stencil-cli': extraHeaders['stencil-cli'],
                    'x-bc-upstream': 'storefront',
                    'stencil-version': packageInfoMock.config.stencil_version,
                },
            });
        });

        it('should call the request library with x-auth-token header if accessToken value is passed', async () => {
            const httpsAgentMock = jest.fn();
            const packageInfoMock = {
                version: '1',
                config: {
                    stencil_version: '2',
                },
            };
            const url = 'https://www.example.com/api/val';
            const accessToken = 'accessToken_value';

            const networkUtils = new NetworkUtils({
                reqLibrary: axiosMock,
                httpsAgent: httpsAgentMock,
                packageInfo: packageInfoMock,
            });
            await networkUtils.sendApiRequest({
                url,
                accessToken,
            });

            expect(axiosMock).toHaveBeenCalledWith({
                url,
                httpsAgent: httpsAgentMock,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'x-auth-token': accessToken,
                    'x-auth-client': 'stencil-cli',
                    'x-bc-upstream': 'storefront',
                    'stencil-cli': packageInfoMock.version,
                    'stencil-version': packageInfoMock.config.stencil_version,
                },
            });
        });

        it('should pass through the response from the request library', async () => {
            const httpsAgentMock = jest.fn();
            const packageInfoMock = {
                version: '1',
                config: {
                    stencil_version: '2',
                },
            };
            const url = 'https://www.example.com/api/val';
            const resMock = {
                data: 'hello world',
            };
            axiosMock.mockResolvedValue(resMock);

            const networkUtils = new NetworkUtils({
                reqLibrary: axiosMock,
                httpsAgent: httpsAgentMock,
                packageInfo: packageInfoMock,
            });
            const actualRes = await networkUtils.sendApiRequest({ url });

            expect(actualRes).toBe(resMock);
        });
    });

    describe('fetchFile', () => {
        it('should pipe the response from the request library to fs', async () => {
            const mockWritable = new MockWritableStream();
            const mockReadable = new PassThrough();
            const fsMock = {
                createWriteStream: jest.fn().mockImplementation(() => mockWritable),
            };
            const url = 'https://www.example.com/api/val';
            const outputPath = 'path/to/some/file';
            const resMockData = 'hello world';
            const networkUtils = new NetworkUtils({
                fs: fsMock,
            });
            const sendApiRequestStub = jest
                .spyOn(networkUtils, 'sendApiRequest')
                .mockResolvedValue({ data: mockReadable });

            const resPromise = networkUtils.fetchFile(url, outputPath);

            // Need to emit the data only after sendApiRequest is resolved (achieved by `await resPromise`),
            //  but resPromise will resolve only after the data is streamed, so we schedule the
            //  data streaming to the next ticks
            setTimeout(() => {
                Array.from(resMockData).forEach((char) => mockReadable.emit('data', char));
                mockReadable.emit('end');
            });

            await resPromise;

            expect(sendApiRequestStub).toHaveBeenCalledWith({
                url,
                responseType: 'stream',
            });
            expect(fsMock.createWriteStream).toHaveBeenCalledWith(outputPath);
            expect(mockWritable.buffer).toEqual(resMockData);
        });
    });
});
