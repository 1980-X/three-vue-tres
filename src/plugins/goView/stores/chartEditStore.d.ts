import type {
    RequestParams,
    RequestHttpIntervalEnum,
    RequestDataTypeEnum,
    RequestHttpEnum,
    RequestContentTypeEnum,
    RequestBodyEnum,
} from '../lib/enums/httpEnum'
import type { PreviewScaleEnum } from '../lib/enums/styleEnum'

export interface RequestConfigType {
    requestDataPondId?: string
    requestInterval?: number | null
    requestIntervalUnit: RequestHttpIntervalEnum
    requestDataType: RequestDataTypeEnum
    requestHttpType: RequestHttpEnum
    requestUrl?: string
    requestContentType: RequestContentTypeEnum
    requestParamsBodyType: RequestBodyEnum
    requestSQLContent: { sql: string }
    requestParams: RequestParams
}

export interface RequestGlobalConfigType {
    requestOriginUrl?: string
    requestInterval: number
    requestIntervalUnit: RequestHttpIntervalEnum
    requestParams: RequestParams
    requestDataPond: Array<{
        dataPondId: string
        dataPondName?: string
        dataPondRequestConfig: RequestConfigType
    }>
}

export interface EditCanvasConfigType {
    width: number
    height: number
    selectColor: boolean
    background?: string
    backgroundImage?: string
    previewScaleType: PreviewScaleEnum
}
