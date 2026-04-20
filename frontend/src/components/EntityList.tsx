import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Spin, Alert, Space, Typography } from 'antd'
import { DatabaseOutlined, RelationshipOutlined } from '@ant-design/icons'
import { Entity, Relationship, SQLParseResult } from '../types'

const { Title, Text } = Typography

interface EntityListProps {
  data: SQLParseResult
}

const EntityList: React.FC<EntityListProps> = ({ data }) => {
  const [loading, setLoading] = useState(false)

  if (data.errors.length > 0) {
    return (
      <Alert
        message="SQL 解析错误"
        description={
          <ul>
            {data.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        }
        type="error"
        showIcon
      />
    )
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>实体列表 ({data.entities.length})</span>
            </Space>
          }
          size="small"
        >
          {data.entities.length === 0 ? (
            <Text type="secondary">暂无实体</Text>
          ) : (
            <div className="entity-list">
              {data.entities.map((entity) => (
                <div key={entity.id} className="entity-item">
                  <Text strong>{entity.name}</Text>
                  <div className="column-list">
                    {entity.columns.map((column) => (
                      <div key={column.id} className="column-item">
                        <Text>
                          {column.name} {column.type}
                          {column.primaryKey && <span className="primary-key"> (PK)</span>}
                          {column.foreignKey && <span className="foreign-key"> (FK)</span>}
                          {!column.nullable && <Text type="danger"> NOT NULL</Text>}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Col>
      
      <Col span={12}>
        <Card
          title={
            <Space>
              <RelationshipOutlined />
              <span>关系列表 ({data.relationships.length})</span>
            </Space>
          }
          size="small"
        >
          {data.relationships.length === 0 ? (
            <Text type="secondary">暂无关系</Text>
          ) : (
            <div className="entity-list">
              {data.relationships.map((relationship) => (
                <div key={relationship.id} className="entity-item">
                  <Text>
                    {relationship.from} {getRelationshipSymbol(relationship.type)} {relationship.to}
                  </Text>
                  <div className="column-list">
                    <Text type="secondary">
                      {relationship.fromColumn} → {relationship.toColumn}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  )
}

const getRelationshipSymbol = (type: string): string => {
  switch (type) {
    case 'one-to-one':
      return '1 : 1'
    case 'one-to-many':
      return '1 : N'
    case 'many-to-one':
      return 'N : 1'
    case 'many-to-many':
      return 'N : M'
    default:
      return '--'
  }
}

export default EntityList